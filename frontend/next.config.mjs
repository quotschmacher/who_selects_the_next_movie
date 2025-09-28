export default {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://api:8000/:path*' },
      { source: '/uploads/:path*', destination: 'http://api:8000/uploads/:path*' },
    ];
  },
}
