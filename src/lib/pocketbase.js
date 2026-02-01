import PocketBase from 'pocketbase';

export const pb = new PocketBase('http://127.0.0.1:8090');
pb.autoCancellation(false);

// Helper to check if user is authenticated
export const isUserLoggedIn = () => {
    return pb.authStore.isValid;
}

// Helper to logout
export const logout = () => {
    pb.authStore.clear();
}
