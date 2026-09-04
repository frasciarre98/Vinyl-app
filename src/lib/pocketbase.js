import PocketBase from 'pocketbase';

// Usa l'IP Tailscale del NAS per permettere l'accesso in mobilità
const pbHost = import.meta.env.VITE_PB_URL || 'http://100.104.254.127:8090';
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
