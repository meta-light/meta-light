export default function imageLoader({ src, width, quality }) {
    if (src.startsWith('http://') || src.startsWith('https://')) {return src;}
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
    return `${base}${src}?w=${width}&q=${quality || 75}`;
}