# Showcase media attribution

BeeECOM is a public reference application. The deterministic product fixtures use real photography so Web and native showcase surfaces exercise realistic image loading, cropping, accessibility labels and responsive layouts instead of placeholder boxes.

The images below are linked from Unsplash and are marked by Unsplash as free to use under the Unsplash License. BeeECOM keeps the original source and photographer metadata in each `ImageAsset` returned by the demo API.

| BeeECOM use | Photographer | Source |
| --- | --- | --- |
| Cloud Tee | Ryan Hoffman | https://unsplash.com/photos/Cs4GVbMqKGY |
| Trail Runner | REVOLT | https://unsplash.com/photos/164_6wVEHfI |
| Field Pack | Sun Lingyan | https://unsplash.com/photos/_H0fjILH5Vw |
| Studio Cap | Mediamodifier | https://unsplash.com/photos/t8HiP3e5abg |
| Storefront campaign reference | mr lee | https://unsplash.com/photos/888HU1GauzY |

## Repository rule

- Do not commit paid, private, scraped or unlicensed product photography.
- Keep a meaningful `alt` value on every customer-visible image.
- Keep source and author metadata when introducing third-party showcase media.
- Do not replace deterministic URLs with random-image endpoints; visual regression evidence needs stable media.
- Production adopters should replace these demo assets with their own licensed product media pipeline/CDN.
