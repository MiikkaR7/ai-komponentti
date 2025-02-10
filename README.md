# Hankeideatyökalu

Hankeideatyökalu, jolla yritysten edustajat ja muut hanketoiminnasta kiinnostuneet voivat hioia hankeideoitaan. Työkalun frontend on React-komponentti, joka kootaan(buildataan)webpack-työkalulla.
Backend-operaatiot tapahtuvat Supabase-tietokannassa. Pyynnöt ohjelmointirajapintoihin tehdään Supabase Edge-funktioilla, jotka käyttävät Deno-ympäristöä ja ovat TypeScript-tiedostoja.
Hankeideatyökalu käyttää openAI-rajapintaa vastauksiin. Työkalu rajoittaa pyyntöjen määrää käyttämällä Upstash Redis-palvelua ja kirjastoa. 
Sähköpostin lähettämisen mahdollistaa SendGrid-palvelu ja kirjasto. Työkalu käyttää myös RAG-teknologiaa. RAG-teknologia käyttää openAI:lla luotuja vektoreita(embedding) tehdäkseen samankaltaisuuslaskennan.
Laskelma tapahtuu Supabasen tietokantafunktion sisällä.
