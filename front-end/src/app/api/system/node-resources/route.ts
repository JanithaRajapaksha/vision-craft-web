import { NextResponse } from "next/server";

export async function GET() {
  const mem = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;

  return NextResponse.json({
    service: "Next.js Frontend (Node.js)",
    runtime: `Node.js ${process.version}`,
    pid: process.pid,
    rss_mb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    heap_total_mb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
    heap_used_mb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    external_mb: Math.round((mem.external / 1024 / 1024) * 10) / 10,
    uptime_seconds: uptimeSeconds,
    uptime_formatted: `${hours}h ${minutes}m ${seconds}s`,
    status: "HEALTHY",
  });
}

