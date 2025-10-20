// functions/api/zentao.js
// Cloudflare Pages Function - 工时 API 代理（修复版）

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
    // 方法1：尝试使用 HTTP（可能被 Cloudflare 阻止）
    const apiUrl = `http://221.122.67.145:8083/zentao/getDataByName?name=${encodeURIComponent(name)}&ftime=${ftime}&ttime=${ttime}`;
    
    console.log('Requesting:', apiUrl);
    
    // 使用更宽松的 fetch 选项
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      // Cloudflare Workers 特定选项
      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
      signal: AbortSignal.timeout(30000)
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
        requestUrl: apiUrl,
        suggestion: '如果持续失败，建议后端 API 启用 HTTPS'
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
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { raw: text };
      }
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
    
    // 检查是否是 Cloudflare 的 1003 错误
    const isCloudflareBlock = error.message.includes('1003') || 
                              error.message.includes('Forbidden') ||
                              error.message.includes('ERR_BLOCKED_BY_CLIENT');
    
    const isTimeout = error.name === 'AbortError' || error.message.includes('timeout');
    
    let errorMessage = '请求失败';
    let suggestion = '';
    
    if (isCloudflareBlock) {
      errorMessage = 'Cloudflare 阻止了 HTTP 请求';
      suggestion = '建议：1) 为后端 API 配置 HTTPS，或 2) 使用其他代理服务（如 Vercel、Railway）';
    } else if (isTimeout) {
      errorMessage = '请求超时';
      suggestion = '目标服务器响应超时，请检查网络或服务器状态';
    }
    
    return new Response(JSON.stringify({
      error: errorMessage,
      message: error.message,
      name: error.name,
      suggestion: suggestion,
      type: 'proxy_error',
      timestamp: new Date().toISOString(),
      note: 'Cloudflare Workers 默认不支持 HTTP 请求，仅支持 HTTPS'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}