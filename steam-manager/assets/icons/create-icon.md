# Creating the Application Icon

To build the application, you need `app.ico` in this folder.

## Quick Method (Recommended)

1. Create or download a 256x256 PNG image for your icon
2. Convert it to ICO using any of these free tools:
   - https://convertico.com/
   - https://icoconvert.com/
   - https://www.freeconvert.com/png-to-ico
3. Save the result as `app.ico` in this folder

## Using Node.js (if png2icons is available)

```bash
npm install -g png2icons
png2icons source.png app -icox
```

## Required File

The build expects: `assets/icons/app.ico`

If the icon file is missing, the build will still work but the EXE won't have a custom icon.
