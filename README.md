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

## Koodista

Komponentin toiminta perustuu App.jsx, index.html ja index.js -tiedostoihin. App.jsx sisältää varsinaisen komponentin ja logiikan. App.jsx käytetään index.js-tiedostossa DOM root-lähteenä. Webpack koostaa(build) index.html ja index.js -tiedostoista bundlatun skriptin ja html-sivun, joka käyttää bundlattua skriptiä. Mahdolliset komponentit, kuten Accordion, sisältyvät buildiin App.jsx kautta.

Komponentin käyttöliittymä on React-komponentti, joka käyttää laajasti useState-hookkeja. Stateilla tallennetaan käyttäjän syötteet ja näkymien arvot. Komponentti käyttää konditionaalista renderöintiä statejen kanssa. Kun käyttäjä sparraa ideaansa, asetetaan staten avulla komponentti lataamaan ja piilotetaan yhteydenottolomake, ja poistetaan Sparraa-nappi väliaikaisesti käytöstä. Kun käyttäjä on käyttänyt komponenttia, hänelle esitetään näkymä, jossa hän voi jatkaa samalla idealla tai aloittaa alusta.

Accordion menu on komponentissa toistuva rakenne, joten se oli järkevä siirtää omaan tiedostoon modulaariseksi komponentiksi, jolle annetaan title, isOpen, toggle ja children-parametrit, jotka hallitsevat sen näkyvyyttä.

Sähköpostinlomakkeen täytetyt ja lähetetyt lomakkeen tallennetaan tietokannan emails-tauluun. Toistaiseksi sähköpostia lähetetä SendGrid-palvelulla. Sähköpostin viesti tarkistetaan Edge funktion sisällä käyttämällä openAI:n gpt4o-mini-mallia suodattamaan roskapostia. Jos viesti on liian lyhyt tai ei sisällä kontekstin eli hankeideatyökalun kannalta relevanttia sisältöä, se lajitellaan roskapostiksi. Gpt4o-mini arvioi viestit asteikolla 0-100, jossa 0 on asiallinen yhteydenotto ja 100 varma roskaposti. Täten suodatusta voi säätää muuttamalla kynnystä funktion sisällä.

Supabasen Edge-funktio "hankeai" ottaa yrittäjän kirjoittaman syötteen ja ajaa sen gpt4o-mallin läpi, mikä antaa yrittäjälle ehdotuksia, rahoituslähteitä ja aiheeseen liittyvän AMK-edustajan yhteystiedot. Gpt4o-mini malli teki paljon kirjoitusvirheitä Suomen kielellä, joten sitä ei ole luonteva käyttää komponentissa. Tekoälyn prompt on jaettu system ja user -viesteihin, joka vähentää väärinkäytön todennäköisyyttä, kun käyttäjä ei voi vaikuttaa tekoälyn ohjeisiin.

OpenAI-rajapinta palauttaa JSON-muotoista dataa, kun sen määrittää response_format-propertyllä ja ohjeistaa promptissa luomaan JSON-dataa. Koko viesti on content-kentässä, hankeidean esimerkkiaihe subject-kentässä, sähköpostiviestin vastaanottaja recipient-kentässä, ja tekoälyn kirjoittama sähköpostiviesti message-kentässä. Käyttökokemuksen kannalta olisi parempi, jos koko tekoälyn vastaus ei ilmestyisi kerralla, vaan se ilmestyisi sitä mukaan, kun tekoäly kirjoittaa vastausta. Tämä stream-toiminto olisi kuitenkin enemmän tai vähemmän ristiriidasssa JSON-datan palauttamisen kanssa, sillä stream-ominaisuus haluaa palauttaa plain textiä.

Promptin konteksti on Postgres-tietokannassa. Konteksti koostuu yleisestä infosta, rahoituslähteistä ja AMK-edustajien yhteystiedoista. Näille on omat taulut. Vastaukset ovat kuitenkin parempia, kun kontekstin antaa JSON-muodossa, eikä tietokannan tauluna.

Jos promptin antaa listana tai luettelona, malli voi takertua ohjeiden muodon ja luettelon täyttämiseen, eikä vastauksen antamiseen. Jos mallia pyytää päättelemään ja käyttää promptissa avainsanaa, malli takertuu ja todennäköisesti ehdottaa sitä. Jos pyytää päättelemään, soveltuuko hankkeeseen opiskelijätyö, se todennäköisesti ehdottaa opiskelijatyötä. Tätä ilmiötä voi lievittää käskemällä mallin tehdä pohdinta kontekstin perusteella luettelon ulkopuolella. Luetteloon kannattaa laittaa vain konkreettisia seikkoja, kuten vastauksen pituus ja muotoilu. 

Rate limit-toiminnallisuuden voi toteuttaa käyttämällä taulua, joka kartoittaa, kuinka monta pyyntöä Edge-funktioon on tehty. Edge-funktio lukee aluksi pyyntöjen määrän, ja päättää voiko se edetä. Jos rate limit-aikaikkuna on umpeutunut, Edge-funktio asettaa sen ajohetken aikaan, ja aloittaa alusta tehtyjen pyyntöjen määrän. Aikarajaa ja pyyntöjen määrää voi helposti säätää muuttujilla.

Jos rahoituslähteiden kuvausten pituus vaihtelee paljon, malli valitsee todennäköisemmin pisimmän. Tämä johti siihen, että malli ehdotti EAKR tai Business Finland-rahoitusta riippumatta hankeidean luonteesta. Kun rahoituslähteiden kuvausten pituudet normalisoitiin, malli ehdottaa hieman monipuolisemmin sopivia rahoituslähteitä.

Komponentin pystyy embedaamaan WordPress-sivulle käyttämällä HTML-blokkia ja <iframe>-elementtiä, jonka lähde on deployattu komponentti.
