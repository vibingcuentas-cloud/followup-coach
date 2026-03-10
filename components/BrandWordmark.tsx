import Image from "next/image";

export default function BrandWordmark() {
  return (
    <Image
      src="/forge-wordmark.svg?v=1"
      alt="Forge"
      width={124}
      height={22}
      priority
      className="brandWordmark"
    />
  );
}
