import { Client, Account, Databases, Storage } from 'appwrite';

export const client = new Client();

export const PROJECT_ID = '67812969000f94b7e551';
export const DATABASE_ID = 'vinyl_db';
export const BUCKET_ID = 'covers';

const ENDPOINT = 'https://cloud.appwrite.io/v1';

client
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

// Helper to check if configuration is missing
export const isAppwriteConfigured = () => {
    return PROJECT_ID !== 'REPLACE_WITH_PROJECT_ID';
}
