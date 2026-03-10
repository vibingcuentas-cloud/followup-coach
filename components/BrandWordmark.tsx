import Image from "next/image";

export default function BrandWordmark() {
  return (
    <Image
      src="/forge-logo.svg"
      alt="Forge"
      width={140}
      height={40}
      priority
      className="brandWordmark"
    />
  );
}
