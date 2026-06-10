/** @type {import('next').NextConfig} */
const nextConfig = {
  // 모노레포 워크스페이스 패키지를 Next가 직접 트랜스파일 (소스 그대로 import)
  transpilePackages: ["@nativo/core", "@nativo/utils"],
  webpack: (config) => {
    // 워크스페이스 패키지 소스는 .js 확장자로 import 하지만 실제 파일은 .ts.
    // (tsconfig moduleResolution: Bundler 와 동일하게) webpack 도 .js→.ts 로 해석.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
