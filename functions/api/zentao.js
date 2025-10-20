// functions/api/zentao.js
// Cloudflare Pages Function - 工时 API 代理

export async function onRequest(context) {
  const { request } = context;
  
  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  // 仅允许 GET 请求
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { 
      status: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  const url = new URL(request.url);
  const name = url.searchParams.get('name');
  const ftime = url.searchParams.get('ftime');
  const ttime = url.searchParams.get('ttime');
  
  if (!name || !ftime || !ttime) {
    return new Response(JSON.stringify({ 
      error: '缺少必要参数',
      required: ['name', 'ftime', 'ttime'],
      example: '/api/zentao?name=张三&ftime=2025-10-01&ttime=2025-10-31'
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  try {
    // 请求原始工时 API
    const apiUrl = `http://221.122.67.145:8083/zentao/getDataByName?name=${encodeURIComponent(name)}&ftime=${ftime}&ttime=${ttime}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Cloudflare-Worker-Proxy'
      }
    });

    if (!response.ok) {
      throw new Error(`API 返回错误: ${response.status}`);
    }

    const data = await response.json();

    // 返回结果并添加 CORS 头
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache', // 工时数据不缓存
      }
    });

  } catch (error) {
    console.error('工时 API 请求失败:', error);
    
    return new Response(JSON.stringify({
      code: -1,
      error: '请求失败',
      message: error.message,
      data: []
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}