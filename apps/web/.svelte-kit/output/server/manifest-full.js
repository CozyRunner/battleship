export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["audio/cannon.mp3","audio/defeat.mp3","audio/explosion.mp3","audio/splash.mp3","audio/thud.mp3","audio/victory.mp3","favicon.png","robots.txt"]),
	mimeTypes: {".mp3":"audio/mpeg",".png":"image/png",".txt":"text/plain"},
	_: {
		client: {start:"_app/immutable/entry/start.BWNCSi9Q.js",app:"_app/immutable/entry/app.CYcAnfq7.js",imports:["_app/immutable/entry/start.BWNCSi9Q.js","_app/immutable/chunks/BvOln2gX.js","_app/immutable/chunks/B6w3ASof.js","_app/immutable/chunks/Bzxs7HYn.js","_app/immutable/entry/app.CYcAnfq7.js","_app/immutable/chunks/B6w3ASof.js","_app/immutable/chunks/BcgnSMxp.js","_app/immutable/chunks/DXLwiZ0H.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
