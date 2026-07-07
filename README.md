# DDUNIT — Usine à vidéos

Pipeline 100 % automatisé : **sujet → script (Groq) → voix off synchronisée
(ElevenLabs) → visuels (Pexels/Pollinations) → rendu Remotion 1080×1920 →
normalisation FFmpeg → MP4 prêt à poster.**

## Utilisation

```bash
node create-video.mjs "Comment aider bébé à faire ses nuits"
```

Résultat : `out/comment-aider-bebe-a-faire-ses-nuits.mp4` (vertical, 45-60 s,
sous-titres mot-à-mot, branding DDUNIT).

Options :
- `--mock` — test de la chaîne complète **sans aucune clé API** (voix silencieuse,
  script de démo, visuels Pollinations)
- `--keep` — conserve les fichiers intermédiaires dans `public/work-<slug>/`

## Configuration (une fois)

Remplir `.env` : `ELEVENLABS_API_KEY` (obligatoire), `GROQ_API_KEY` (obligatoire),
`PEXELS_API_KEY` (optionnel), `ELEVENLABS_VOICE_ID` (choix de la voix).

## Prévisualisation / retouche du template

```bash
npx remotion studio        # éditeur visuel de la composition (src/Video.tsx)
```

## Architecture

- `create-video.mjs` — script maître (orchestration complète)
- `src/Video.tsx` — la composition : fonds Ken Burns, sous-titres style TikTok
  (mot actif en or), bandeau DDUNIT, barre de progression
- `src/Root.tsx` — déclaration de la composition (durée calculée depuis la voix)
- `public/work-<slug>/` — assets temporaires d'un rendu
- `out/` — vidéos finales
