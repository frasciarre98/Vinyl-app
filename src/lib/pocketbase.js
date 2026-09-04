import PocketBase from 'pocketbase';

// Usa l'IP del NAS se non specificato altrimenti, in modo che funzioni anche dal cellulare.
const pbHost = import.meta.env.VITE_PB_URL || 'http://192.168.0.250:8090';
export const pb = new PocketBase(pbHost);
pb.autoCancellation(false);

// Helper to check if user is authenticated
export const isUserLoggedIn = () => {
    return pb.authStore.isValid;
}

// Helper to logout
export const logout = () => {
    pb.authStore.clear();
}
