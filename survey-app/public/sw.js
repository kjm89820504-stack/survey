self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
// 응답·인증·API는 캐시하지 않습니다. 제출은 인터넷 연결이 필요합니다.
self.addEventListener('fetch',()=>{});
