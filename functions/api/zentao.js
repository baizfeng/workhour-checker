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
    return new Response(JSON.stringify({ 
      error: 'Method Not Allowed',
      method: request.method 
    }), { 
      status: 405,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
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
      received: { name, ftime, ttime },
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
    
    console.log('Requesting:', apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Cloudflare-Worker-Proxy'
      },
      // 添加超时设置
      signal: AbortSignal.timeout(30000) // 30秒超时
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      
      return new Response(JSON.stringify({
        error: 'API 返回错误',
        status: response.status,
        statusText: response.statusText,
        detail: errorText,
        requestUrl: apiUrl
      }), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.log('Non-JSON response:', text);
      data = { raw: text };
    }

    console.log('API response data:', data);

    // 返回结果并添加 CORS 头
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      }
    });

  } catch (error) {
    console.error('工时 API 请求失败:', error);
    
    // 检查是否是超时错误
    const isTimeout = error.name === 'AbortError' || error.message.includes('timeout');
    
    return new Response(JSON.stringify({
      error: isTimeout ? '请求超时' : '请求失败',
      message: error.message,
      name: error.name,
      stack: error.stack,
      type: 'proxy_error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}