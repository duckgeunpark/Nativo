/** @type {import('next').NextConfig} */
const nextConfig = {
  // 모노레포 워크스페이스 패키지를 Next가 직접 트랜스파일 (소스 그대로 import)
  transpilePackages: ["@nativo/core", "@nativo/utils"],
};

export default nextConfig;
