# Application Icons

Place application icons here for packaging:

## Required Files

| File | Platform | Size |
|------|----------|------|
| `icon.ico` | Windows | 256x256 (multi-size ICO) |
| `icon.png` | Linux | 512x512 PNG |
| `icon.icns` | macOS | Multi-resolution ICNS |

## Icon Sizes (for ICO)

The Windows ICO should contain these sizes:
- 16x16
- 32x32
- 48x48
- 64x64
- 128x128
- 256x256

## Generation

You can use tools like:
- [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder)
- [png2icons](https://www.npmjs.com/package/png2icons)
- Online converters

Start with a 1024x1024 PNG source image and generate all formats from it.
