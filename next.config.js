/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ⚙️ ปิด output export เพื่อให้ API Routes ทำงาน (จำเป็นสำหรับ OCR server)
  output: undefined,

  images: {
    unoptimized: true, // ปิด optimize รูป (ทำให้ dev/build เร็วขึ้น)
  },

  experimental: {
    workerThreads: false, // ปิด worker script (แก้ error ของ tesseract.js)
    wasmMemory: false,
  },

  webpack: (config) => {
    // ✅ ป้องกัน error worker-script และ fs/path module
    config.resolve.fallback = {
      fs: false,
      path: false,
      worker_threads: false,
    };
    return config;
  },
};

export default nextConfig;
