import { createClient } from '@supabase/supabase-js'

// Ho inserito direttamente le tue chiavi qui per essere SICURO che funzionino
// senza dipendere dal file .env o dai riavvii del server.

// Correct API URL (derived from your project ID)
const supabaseUrl = 'https://fltummziiqpnorzsbyan.supabase.co'

// Your Anon Key
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsdHVtbXppaXFwbm9yenNieWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNzg4MjAsImV4cCI6MjA4Mjc1NDgyMH0.RXyh8W29qDEd1jWy50aa3tO5bGHektiqp4ZJDtgJUyA'

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Key is missing.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
