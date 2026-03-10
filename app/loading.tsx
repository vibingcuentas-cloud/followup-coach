import Image from "next/image";

export default function Loading() {
  return (
    <main className="forgeSplash">
      <div className="forgeSplashInner">
        <Image
          src="/forge-icon.svg"
          alt="Forge"
          width={56}
          height={56}
          priority
          className="forgeSplashIcon"
        />
        <Image
          src="/forge-wordmark.svg?v=1"
          alt="Forge"
          width={124}
          height={22}
          priority
          className="brandWordmark"
        />
      </div>
    </main>
  );
}
