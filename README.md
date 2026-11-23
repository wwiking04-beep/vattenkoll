# Vattenkoll

Ett tryck per glas vatten, en ring som fylls mot dagens mål och en enkel veckohistorik. Byggd med Vite och Supabase, deployad på Vercel. Fungerar som webbapp på iPhone (Dela → Lägg till på hemskärmen).

Data sparas i tabellen `glas` med ett anonymt enhets-id (localStorage). RLS släpper bara igenom rader där `device_id` matchar huvudet `x-device-id`.
