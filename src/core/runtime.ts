export function routingConfiguration(hostname:string,endpoint='',mode=''){
  const loopback=hostname==='localhost'||hostname==='127.0.0.1'||hostname==='[::1]';
  return {browser:mode==='browser'||(mode!=='service'&&!loopback&&!endpoint),endpoint:endpoint||'/api/routing'};
}
export const routingConfig=routingConfiguration(globalThis.location?.hostname||'',import.meta.env?.VITE_ROUTING_API||'',new URLSearchParams(globalThis.location?.search||'').get('routing')==='browser'?'browser':import.meta.env?.VITE_ROUTING_MODE||'');
