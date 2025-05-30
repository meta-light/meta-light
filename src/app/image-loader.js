export default function imageLoader({ src, width, quality }) {
    if (src.startsWith('http://') || src.startsWith('https://')) {return src;}
    return `${process.env.NEXT_PUBLIC_BASE_URL}${src}?w=${width}&q=${quality || 75}`;
}