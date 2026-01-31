import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Trash2, Upload, Image as ImageIcon, Crop, RotateCcw, Lock, Unlock, CheckCircle, Move, Camera } from 'lucide-react';
import { databases, storage, DATABASE_ID, BUCKET_ID, PROJECT_ID } from '../lib/appwrite';
import { ID } from 'appwrite';
import { resizeImage } from '../lib/openai';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../lib/imageUtils';
import { PerspectiveCropper } from './PerspectiveCropper';

export function EditVinylModal({ vinyl, isOpen, onClose, onUpdate, onDelete }) {
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
        is_tracks_validated: false,
        is_price_locked: false,
        rating: 0,
        label: '',
        catalog_number: '',
        edition: '',
        purchase_price: '',
        purchase_year: ''
    });
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    // Crop State
    const [isCropping, setIsCropping] = useState(false);
    const [perspectiveMode, setPerspectiveMode] = useState(false);
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
                is_tracks_validated: vinyl.is_tracks_validated || false,
                is_price_locked: vinyl.is_price_locked || false,
                rating: vinyl.rating || 0,
                label: vinyl.label || '',
                catalog_number: vinyl.catalog_number || '',
                edition: vinyl.edition || '',
                purchase_price: vinyl.purchase_price || '',
                purchase_year: vinyl.purchase_year || ''
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
            console.error('Error updating vinyl:', err);
            alert(`Errore nel salvataggio: ${err.message}\n\nProbabilmente mancano gli attributi 'is_tracks_validated' o 'is_price_locked' nel database Appwrite.`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (onDelete) {
            onDelete(vinyl.id);
            onClose();
        } else {
            // Fallback (should not be used ideally if we want Undo)
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
            // Use proxy to bypass CORS on mobile LAN (192.168.x.x) AND Vercel Production
            // Vite handles this locally, Vercel Rewrites handle this in production (vercel.json)
            const PROXY_PREFIX = '/appwrite-proxy';
            const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';

            // Start with original URL
            let fetchUrl = vinyl.image_url;

            // ALWAYS use proxy if URL is from Appwrite Cloud
            if (vinyl.image_url.startsWith(APPWRITE_ENDPOINT)) {
                fetchUrl = vinyl.image_url.replace(APPWRITE_ENDPOINT, PROXY_PREFIX);
                console.log("Using Proxy URL for CORS:", fetchUrl);
            }

            // Add timestamp AND Project ID to authenticate the request
            const separator = fetchUrl.includes('?') ? '&' : '?';
            const cacheBuster = `${separator}t=${Date.now()}&project=${PROJECT_ID}&mode=admin`;

            // Fetch as blob with explicit CORS mode
            const response = await fetch(fetchUrl + cacheBuster, {
                mode: 'cors',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (!response.ok) throw new Error(`Network response error: ${response.status} ${response.statusText}`);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            setCropImageSrc(objectUrl);
            setIsCropping(true);
            setZoom(1);
            setRotation(0);
        } catch (error) {
            console.error("Failed to load image for cropping:", error);
            // DEBUG: Show exact URL and error
            alert(`DEBUG ERROR:\nURL: ${fetchUrl}\nERR: ${error.message}\n\nPlease screenshot this.`);

            // Fallback
            fileInputRef.current?.click();
        } finally {
            setUploadingImage(false);
        }
    };

    const handleStartPerspective = async () => {
        if (!vinyl.image_url) return;
        setUploadingImage(true);
        try {
            // Use proxy to bypass CORS on mobile LAN (192.168.x.x) AND Vercel Production
            const PROXY_PREFIX = '/appwrite-proxy';
            const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';

            let fetchUrl = vinyl.image_url;
            if (vinyl.image_url.startsWith(APPWRITE_ENDPOINT)) {
                fetchUrl = vinyl.image_url.replace(APPWRITE_ENDPOINT, PROXY_PREFIX);
            }

            // Add timestamp and Project ID
            const separator = fetchUrl.includes('?') ? '&' : '?';
            const cacheBuster = `${separator}t=${Date.now()}&project=${PROJECT_ID}&mode=admin`;

            const response = await fetch(fetchUrl + cacheBuster, {
                mode: 'cors',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (!response.ok) throw new Error(`Network response error: ${response.status} ${response.statusText}`);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            setCropImageSrc(objectUrl);
            setIsCropping(true);
            setPerspectiveMode(true);
            setPerspectiveMode(true);
        } catch (error) {
            console.error("Failed to load image for perspective:", error);
            // DEBUG: Show exact URL and error
            alert(`DEBUG ERROR (Perspective):\nURL: ${fetchUrl}\nERR: ${error.message}\n\nPlease screenshot this.`);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSavePerspective = async (blob) => {
        if (!blob || blob.size < 1000) {
            alert("Error: Generated image is too small or empty. Please try again.");
            return;
        }

        setUploadingImage(true);
        try {
            console.log("Uploading warped image...");
            // Blob is already optimized by perspective.js (max 1200px, jpeg 0.9)
            // No need to resizeImage again.
            const uploadFile = new File([blob], `warped-${Date.now()}.jpg`, { type: 'image/jpeg' });

            const fileUpload = await storage.createFile(
                BUCKET_ID,
                ID.unique(),
                uploadFile
            );

            const viewResult = storage.getFileView(BUCKET_ID, fileUpload.$id);
            const publicUrl = viewResult.href ? viewResult.href : String(viewResult);

            console.log("New Perspective URL:", publicUrl);

            await databases.updateDocument(DATABASE_ID, 'vinyls', vinyl.id, { image_url: publicUrl });

            onUpdate();
            setIsCropping(false);
            setPerspectiveMode(false);
            setCropImageSrc(null);
            alert('Perspective correction applied successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to save warped image: ' + err.message);
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-heavy rounded-xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 glass-panel z-10">
                    <h2 className="text-lg font-semibold">
                        {isCropping ? (perspectiveMode ? 'Perspective Fix' : 'Crop & Rotate') : 'Edit Album'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {isCropping ? (
                    perspectiveMode ? (
                        <div className="h-[65vh] min-h-[400px] flex flex-col">
                            <PerspectiveCropper
                                imageSrc={cropImageSrc}
                                onComplete={handleSavePerspective}
                                onCancel={() => { setIsCropping(false); setPerspectiveMode(false); setCropImageSrc(null); }}
                            />
                        </div>
                    ) : (
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
                    )
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">

                        {/* Cover Image Replacement Section */}
                        <div className="flex items-center gap-4 bg-black/40 border border-white/10 p-3 rounded-lg">
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

                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        disabled={uploadingImage}
                                        className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
                                    >
                                        <Camera className="w-3 h-3" /> Photo
                                    </button>

                                    {vinyl.image_url && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleEditExisting}
                                                className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
                                            >
                                                <Crop className="w-3 h-3" /> Crop / Rotate {rotation > 0 && `(${rotation}°)`}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleStartPerspective}
                                                className="text-xs bg-white/10 hover:bg-white/20 text-green-300 px-3 py-1.5 rounded-md transition-colors flex items-center gap-2"
                                            >
                                                <Move className="w-3 h-3" /> Perspective
                                            </button>
                                        </>
                                    )}

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <input
                                        type="file"
                                        ref={cameraInputRef}
                                        onChange={handleFileSelect}
                                        accept="image/*"
                                        capture="environment"
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
                                    className="w-full bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent text-slate-900 placeholder-slate-400"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-secondary mb-1">Artist</label>
                                <input
                                    type="text"
                                    value={formData.artist}
                                    onChange={e => setFormData({ ...formData, artist: e.target.value })}
                                    className="w-full bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent text-slate-900 placeholder-slate-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1">Year</label>
                                <input
                                    type="text"
                                    value={formData.year}
                                    onChange={e => setFormData({ ...formData, year: e.target.value })}
                                    className="w-full bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent text-slate-900 placeholder-slate-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1">Genre</label>
                                <input
                                    type="text"
                                    value={formData.genre}
                                    onChange={e => setFormData({ ...formData, genre: e.target.value })}
                                    className="w-full bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent text-slate-900 placeholder-slate-400"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-secondary mb-1">Group Members</label>
                                <input
                                    type="text"
                                    value={formData.group_members || ''}
                                    onChange={e => setFormData({ ...formData, group_members: e.target.value })}
                                    placeholder="e.g. John Lennon, Paul McCartney..."
                                    className="w-full bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent text-slate-900 placeholder-slate-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-1">Format</label>
                                <select
                                    value={formData.format}
                                    onChange={e => setFormData({ ...formData, format: e.target.value })}
                                    className="w-full bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent text-slate-900"
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
                                    className="w-full bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent text-slate-900"
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
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-500">€</span>
                                    <input
                                        type="text"
                                        value={formData.average_cost || ''}
                                        onChange={e => setFormData({ ...formData, average_cost: e.target.value })}
                                        placeholder="20-30"
                                        className="w-full bg-white/50 border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-1 focus:ring-accent text-slate-900 placeholder-slate-400"
                                    />
                                </div>
                                <div className="mt-1 flex justify-end">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs select-none text-secondary hover:text-primary transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_price_locked}
                                            onChange={e => setFormData({ ...formData, is_price_locked: e.target.checked })}
                                            className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
                                        />
                                        <span className="flex items-center gap-1">
                                            {formData.is_price_locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                            {formData.is_price_locked ? 'Price Locked' : 'Auto-Estimate'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* --- COLLECTOR INFO SECTION --- */}
                            <div className="col-span-2 pt-2 border-t border-white/5 mt-2">
                                <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Collector Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-secondary mb-1">Label</label>
                                        <input
                                            type="text"
                                            value={formData.label}
                                            onChange={e => setFormData({ ...formData, label: e.target.value })}
                                            placeholder="e.g. Blue Note"
                                            className="w-full bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent text-slate-900 placeholder-slate-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-secondary mb-1">Catalog No.</label>
                                        <input
                                            type="text"
                                            value={formData.catalog_number}
                                            onChange={e => setFormData({ ...formData, catalog_number: e.target.value })}
                                            placeholder="e.g. PCS 7027"
                                            className="w-full bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent text-slate-900 placeholder-slate-400"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-secondary mb-1">Edition / Variant</label>
                                        <input
                                            type="text"
                                            value={formData.edition}
                                            onChange={e => setFormData({ ...formData, edition: e.target.value })}
                                            placeholder="e.g. 1st Press, Red Vinyl, Japanese Import"
                                            className="w-full bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent text-slate-900 placeholder-slate-400"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* --- HISTORY SECTION --- */}
                            <div className="col-span-2 pt-2 border-t border-white/5">
                                <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">My History</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-secondary mb-1">Purchase Price</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-gray-500">€</span>
                                            <input
                                                type="text"
                                                value={formData.purchase_price}
                                                onChange={e => setFormData({ ...formData, purchase_price: e.target.value })}
                                                placeholder="25.00"
                                                className="w-full bg-white/50 border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-1 focus:ring-accent text-slate-900 placeholder-slate-400"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-secondary mb-1">Year Bought</label>
                                        <input
                                            type="text"
                                            value={formData.purchase_year}
                                            onChange={e => setFormData({ ...formData, purchase_year: e.target.value })}
                                            placeholder="e.g. 2023"
                                            className="w-full bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent text-slate-900 placeholder-slate-400"
                                        />
                                    </div>
                                </div>
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
                                    className={`w-full bg-white/50 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent resize-vertical font-mono text-slate-900 placeholder-slate-400 ${formData.is_tracks_validated ? 'border-green-500/30 ring-1 ring-green-500/10' : 'border-slate-200'}`}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-secondary mb-1">Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                    className="w-full bg-white/50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-accent resize-none text-slate-900 placeholder-slate-400"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-secondary mb-1">Rating</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, rating: star })}
                                            className={`p-1 transition-transform hover:scale-110 ${(formData.rating || 0) >= star ? 'text-yellow-400' : 'text-gray-600'
                                                }`}
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                                className="w-6 h-6"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, rating: 0 })}
                                        className="text-xs text-gray-500 ml-2 hover:text-white"
                                    >
                                        Clear
                                    </button>
                                </div>
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


