import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Trash2, Upload, Image as ImageIcon, Crop, RotateCcw, Lock, Unlock, CheckCircle } from 'lucide-react';
import { databases, storage, DATABASE_ID, BUCKET_ID } from '../lib/appwrite';
import { ID } from 'appwrite';
import { resizeImage } from '../lib/openai';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../lib/imageUtils';

export function EditVinylModal({ vinyl, isOpen, onClose, onUpdate }) {
    const [formData, setFormData] = useState({
        title: '',
        artist: '',
        year: '',
        genre: '',
        format: 'Vinyl',
        condition: '',
        average_cost: '',
        notes: '',
        tracks: '',
        group_members: '',
        is_tracks_validated: false
    });
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef(null);

    // Crop State
    const [isCropping, setIsCropping] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    useEffect(() => {
        if (vinyl) {
            setFormData({
                title: vinyl.title || '',
                artist: vinyl.artist || '',
                year: vinyl.year || '',
                genre: vinyl.genre || '',
                format: vinyl.format || 'Vinyl',
                group_members: vinyl.group_members || '',
                condition: vinyl.condition || '',
                average_cost: vinyl.avarege_cost || vinyl.average_cost || '',
                notes: vinyl.notes || '',
                tracks: vinyl.tracks || '',
                is_tracks_validated: vinyl.is_tracks_validated || false
            });
        }
    }, [vinyl]);

    if (!isOpen || !vinyl) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Map average_cost to avarege_cost (DB typo) and sanitize
            const cleanCost = String(formData.average_cost || '').substring(0, 50);
            const payload = { ...formData, avarege_cost: cleanCost };
            delete payload.average_cost;

            await databases.updateDocument(DATABASE_ID, 'vinyls', vinyl.id, payload);
            onUpdate();
            onClose();
        } catch (err) {
            console.error('Error updating vinyl:', err);
            alert(`Errore nel salvataggio: ${err.message}\n\nProbabilmente manca l'attributo 'is_tracks_validated' (boolean) nel database Appwrite.`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this record?')) return;
        setSaving(true);
        try {
            await databases.deleteDocument(DATABASE_ID, 'vinyls', vinyl.id);
            onUpdate();
            onClose();
        } catch (err) {
            console.error('Error deleting vinyl:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Read file as URL for cropper
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setCropImageSrc(reader.result);
            setIsCropping(true);
            setZoom(1);
            setRotation(0);
        });
        reader.readAsDataURL(file);

        // Reset input so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleEditExisting = async () => {
        if (!vinyl.image_url) return;
        setUploadingImage(true);
        try {
            // Fetch as blob to avoid CORS issues with Canvas
            const response = await fetch(vinyl.image_url, { mode: 'cors' });
            if (!response.ok) throw new Error("Network response was not ok");
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            setCropImageSrc(objectUrl);
            setIsCropping(true);
            setZoom(1);
            setRotation(0);
        } catch (error) {
            console.error("Failed to load image for cropping:", error);
            alert("Browser Security (CORS) blocked editing this remote image.\n\nPlease select the original file from your device to crop it.");
            // Automatically trigger file selection as fallback
            fileInputRef.current?.click();
        } finally {
            setUploadingImage(false);
        }
    };

    const onCropComplete = (croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleSaveCrop = async () => {
        setUploadingImage(true);
        try {
            console.log("Step 1: generating crop...");
            if (!croppedAreaPixels) throw new Error("No crop area defined");

            const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels, rotation);
            if (!croppedBlob) throw new Error("Crop generation returned null");

            console.log("Step 2: compressing...");
            // Compress resulted crop
            const file = new File([croppedBlob], "cropped.jpg", { type: "image/jpeg" });
            const compressedDataUrl = await resizeImage(file);
            const compressedBlob = await (await fetch(compressedDataUrl)).blob();

            console.log("Step 3: uploading...");
            // Reconstruct File for Appwrite
            const uploadFile = new File([compressedBlob], `cropped-${Date.now()}.jpg`, { type: 'image/jpeg' });

            // Upload to Appwrite Storage
            const fileUpload = await storage.createFile(
                BUCKET_ID,
                ID.unique(),
                uploadFile
            );

            console.log("Step 4: final update...");
            // Get Public URL - Handle both URL object (newer SDK) and string (older SDK)
            const viewResult = storage.getFileView(BUCKET_ID, fileUpload.$id);
            const publicUrl = viewResult.href ? viewResult.href : String(viewResult);

            if (!publicUrl || publicUrl === 'undefined') {
                throw new Error(`Failed to generate Public URL. Result was: ${JSON.stringify(viewResult)}`);
            }

            console.log("Updating with URL:", publicUrl);

            // Update Vinyl Record immediately
            await databases.updateDocument(DATABASE_ID, 'vinyls', vinyl.id, { image_url: publicUrl });

            onUpdate();
            setIsCropping(false);
            setCropImageSrc(null);
            alert('Cover updated successfully!');
        } catch (err) {
            console.error('Error saving crop:', err);
            const errMsg = err.message || (typeof err === 'string' ? err : 'Unknown error (possibly CORS)');
            alert('Failed to save cropped image: ' + errMsg);
        } finally {
            setUploadingImage(false);
        }
    };

    // Auto-lock validation when user types in tracks
    const handleTracksChange = (newTracks) => {
        setFormData(prev => ({
            ...prev,
            tracks: newTracks,
            is_tracks_validated: true // Auto-check validation on manual edit
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-surface z-10">
                    <h2 className="text-lg font-semibold">{isCropping ? 'Crop & Rotate' : 'Edit Album'}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {isCropping ? (
                    <div className="p-4 h-[500px] flex flex-col">
                        <div className="relative flex-1 bg-black rounded-lg overflow-hidden border border-white/10 mb-4">
                            <Cropper
                                image={cropImageSrc}
                                crop={crop}
                                zoom={zoom}
                                rotation={rotation}
                                aspect={1}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                                onRotationChange={setRotation}
                            />
                        </div>

                        <div className="space-y-4 px-2">
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-secondary w-12">Zoom</span>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    aria-labelledby="Zoom"
                                    onChange={(e) => setZoom(e.target.value)}
                                    className="flex-1 accent-primary h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-secondary w-12">Rotate</span>
                                <input
                                    type="range"
                                    value={rotation}
                                    min={0}
                                    max={360}
                                    step={1}
                                    aria-labelledby="Rotation"
                                    onChange={(e) => setRotation(e.target.value)}
                                    className="flex-1 accent-primary h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => { setIsCropping(false); setCropImageSrc(null); }}
                                    className="px-4 py-2 text-sm text-secondary hover:text-primary"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveCrop}
                                    disabled={uploadingImage}
                                    className="px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {uploadingImage ? 'Saving...' : 'Save Image'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">

                        {/* Cover Image Replacement Section */}
                        <div className="flex items-center gap-4 bg-background border border-border p-3 rounded-lg">
                            <div className="w-16 h-16 bg-black/40 rounded overflow-hidden flex-shrink-0 flex items-center justify-center border border-white/10">
                                {vinyl.image_url ? (
                                    <img src={vinyl.image_url} alt="Current Cover" className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="w-6 h-6 text-white/20" />
                                )}
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-secondary mb-1">Cover Image</label>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingImage}
                                        className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
                                    >
                                        <Upload className="w-3 h-3" /> Replace
                                    </button>

                                    {vinyl.image_url && (
                                        <button
                                            type="button"
                                            onClick={handleEditExisting}
                                            className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
                                        >
                                            <Crop className="w-3 h-3" /> Crop / Rotate {rotation > 0 && `(${rotation}°)`}
                                        </button>
                                    )}

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                </div>
                                <p className="text-[10px] text-white/40 mt-1">
                                    Replace or Edit will launch the optimization editor.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-secondary mb-1">Album Title</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-secondary mb-1">Artist</label>
                                <input
                                    type="text"
                                    value={formData.artist}
                                    onChange={e => setFormData({ ...formData, artist: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1">Year</label>
                                <input
                                    type="text"
                                    value={formData.year}
                                    onChange={e => setFormData({ ...formData, year: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1">Genre</label>
                                <input
                                    type="text"
                                    value={formData.genre}
                                    onChange={e => setFormData({ ...formData, genre: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-secondary mb-1">Group Members</label>
                                <input
                                    type="text"
                                    value={formData.group_members || ''}
                                    onChange={e => setFormData({ ...formData, group_members: e.target.value })}
                                    placeholder="e.g. John Lennon, Paul McCartney..."
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1">Format</label>
                                <select
                                    value={formData.format}
                                    onChange={e => setFormData({ ...formData, format: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent"
                                >
                                    <option value="Vinyl">Vinyl</option>
                                    <option value="CD">CD</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1">Condition</label>
                                <select
                                    value={formData.condition}
                                    onChange={e => setFormData({ ...formData, condition: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent"
                                >
                                    <option value="Mint">Mint</option>
                                    <option value="Near Mint">Near Mint</option>
                                    <option value="Very Good Plus">Very Good Plus</option>
                                    <option value="Good">Good</option>
                                    <option value="Fair">Fair</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1">Average Cost</label>
                                <input
                                    type="text"
                                    value={formData.average_cost || ''}
                                    onChange={e => setFormData({ ...formData, average_cost: e.target.value })}
                                    placeholder="e.g. €20-30"
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent"
                                />
                            </div>
                            <div className="col-span-2">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium text-secondary">Tracks (One per line)</label>
                                    <label className="flex items-center gap-2 cursor-pointer text-xs select-none bg-white/5 px-2 py-1 rounded border border-white/10 hover:bg-white/10 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_tracks_validated}
                                            onChange={e => setFormData({ ...formData, is_tracks_validated: e.target.checked })}
                                            className="w-4 h-4 rounded accent-green-500 cursor-pointer"
                                        />
                                        <span className={`flex items-center gap-1 font-bold ${formData.is_tracks_validated ? 'text-green-400' : 'text-gray-400'}`}>
                                            {formData.is_tracks_validated ? <CheckCircle className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                            {formData.is_tracks_validated ? 'LOCKED (AI Proof)' : 'Unlocked'}
                                        </span>
                                    </label>
                                </div>
                                <textarea
                                    value={formData.tracks || ''}
                                    onChange={e => handleTracksChange(e.target.value)}
                                    rows={5}
                                    placeholder="1. Song A&#10;2. Song B"
                                    className={`w-full bg-background border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent resize-vertical font-mono ${formData.is_tracks_validated ? 'border-green-500/30 ring-1 ring-green-500/10' : 'border-border'}`}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-secondary mb-1">Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent resize-none"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border flex justify-between items-center">
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1 px-2 py-1 hover:bg-red-900/10 rounded transition-colors"
                            >
                                <Trash2 className="w-4 h-4" /> Delete
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm text-secondary hover:text-primary transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}


