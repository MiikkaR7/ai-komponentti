# Project idea tool
Project idea tool which entrepreneurs and others interested in project with universities can use to improve and get feedback on their ideas. 

The backend operations happen inside a Supabase database. The requests utilize Supabase Edge functions, which use the Deno environment and are in TypeScript. 

The tool uses the openAI chat completions for it's responses to project ideas. 

The tool has a custom rate limit that uses the Postgres database inside Supabase to track and limit requests.

The email functionality is made possible with SendGrid.

The tool experimented with RAG to enchance prompts, but the improvements were minimal.

# Hankeideatyökalu

Hankeideatyökalu, jolla yritysten edustajat ja muut hanketoiminnasta kiinnostuneet voivat hioia hankeideoitaan. Työkalun frontend on React-komponentti, joka kootaan(buildataan)webpack-työkalulla.

Backend-operaatiot tapahtuvat Supabase-tietokannassa. Pyynnöt ohjelmointirajapintoihin tehdään Supabase Edge-funktioilla, jotka käyttävät Deno-ympäristöä ja ovat TypeScript-tiedostoja.

Hankeideatyökalu käyttää openAI-rajapintaa vastauksiin. 

Työkaluun on tehty rate limit-toiminnallisuus käyttäen Postgres-tietokantaa.

Sähköpostin lähettämisen mahdollistaa SendGrid-palvelu ja kirjasto. Työkalu käyttää myös RAG-teknologiaa. RAG-teknologia käyttää openAI:lla luotuja vektoreita(embedding) tehdäkseen samankaltaisuuslaskennan.
Laskelma tapahtuu Supabasen tietokantafunktion sisällä.
