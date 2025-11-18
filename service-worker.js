{\rtf1\ansi\ansicpg1252\cocoartf2759
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const CACHE_NAME = 'fresamelon-v1';\
const URLS_TO_CACHE = [\
  './',\
  './index.html',\
  './manifest.json',\
  './icons/icon-192.png',\
  './icons/icon-512.png'\
];\
\
self.addEventListener('install', (event) => \{\
  event.waitUntil(\
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))\
  );\
\});\
\
self.addEventListener('activate', (event) => \{\
  event.waitUntil(\
    caches.keys().then((keys) =>\
      Promise.all(\
        keys\
          .filter((key) => key !== CACHE_NAME)\
          .map((key) => caches.delete(key))\
      )\
    )\
  );\
\});\
\
self.addEventListener('fetch', (event) => \{\
  event.respondWith(\
    caches.match(event.request).then((response) => \{\
      return response || fetch(event.request);\
    \})\
  );\
\});\
}