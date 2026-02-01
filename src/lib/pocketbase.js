import PocketBase from 'pocketbase';

const pbHost = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
export const pb = new PocketBase(`http://${pbHost}:8090`);
pb.autoCancellation(false);

// Helper to check if user is authenticated
export const isUserLoggedIn = () => {
    return pb.authStore.isValid;
}

// Helper to logout
export const logout = () => {
    pb.authStore.clear();
}
