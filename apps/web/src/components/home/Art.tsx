"use client"
import Image from "next/image"

export default function Art() {
  const images = [
    // "https://shdw-drive.genesysgo.net/DojEG4vUWnUZdbSUiajdNagYBtyqkZQaduvR6ya5Mfuy/DeWiCat-20-01ceg.gif",
    "/home/jito.png",
    "/home/cat1.gif",
    "/home/cat2.gif",
    // "https://shdw-drive.genesysgo.net/DojEG4vUWnUZdbSUiajdNagYBtyqkZQaduvR6ya5Mfuy/DeWiCat-40-xaxwy.gif",
    "https://na-assets.pinit.io/Dk6Ug2wbS8WiRF18AaAqJHyx93dWx7q5bxPmm2WxKP8K/bdaecbad-b31e-42b2-b0ea-25f9b44219ff/2909",
    "https://kqdrcflo4udv6fuso2idqze4xriydwboumpysiklwvfjzroyrdna.arweave.net/VAcRFW7lB18WknaQOGScvFGB2C6jH4khS7VKnMXYiNo?ext=jpg",
    "https://hews4nahwvpxmtgf5buyphoo3do5omfzgta3c3dewpj3pye6hg5q.arweave.net/OS0uNAe1X3ZMxehph53O2N3XMLk0wbFsZLPTt-CeObs?ext=png",
    // "https://p3o27r5siavoajgj5zjrg34tm2mozm4ya4ukomq2nti2q5rrnruq.arweave.net/ft2vx7JAKuAkye5TE2-TZpjss5gHKKcyGmzRqHYxbGk?ext=png",
    "https://jt3ivxt36qziq3gzklitnipiruptzezehw72b62kw53egkv7glha.arweave.net/TPaK3nv0Mohs2VLRNqHojR88kyQ9v6D7Srd2Qyq_Ms4/1707606148.3841.png",
    "https://underdog-protocol.s3.us-west-1.amazonaws.com/6626ebfe-f65d-401a-8087-816ad36ea1bf.png",
    "https://prod-tensor-creators-s3.s3.us-east-1.amazonaws.com/drop-metadata/b76b5eb6-8c82-4089-bfb5-8dd7f35bbcb7/images/4542.png",
    "https://pt2mx3s3wtvbx2ryeebg3efrmby3i3smf7svrwvkfy7wouj44deq.arweave.net/fPTL7lu06hvqOCECbZCxYHG0bkwv5Vjaqi4_Z1E84Mk?ext=png",
    "https://updg8.com/imgdata/5otux6WEGtGfq4rEevSYwfvLWehNBSqF2DsFDAxcUwKo",
  ]

  return (
    <div className="min-h-screen bg-black text-gray-100 font-mono">
      <main className="max-w-6xl mx-auto px-6">
        <section className="mb-20 border-t border-gray-800 pt-20">
          <h2 className="text-2xl font-bold mb-12 text-center">Art</h2>
          <div className="flex flex-col md:flex-row md:flex-wrap justify-center">
            {images.map((image, index) => (
                <div key={index} className="relative h-64 md:h-80 w-full md:w-1/3 flex-none border-r border-gray-800 md:last:border-r-0 md:[&:nth-child(3n)]:border-r-0">
                    <Image
                        src={image}
                        alt={`Artwork ${index + 1}`}
                        fill
                        className="object-cover grayscale"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        priority={index < 3}
                        onError={(e) => {
                          console.error(`Failed to load image ${index + 1}:`, image);
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}