import type { MetadataRoute } from 'next'
export default function sitemap():MetadataRoute.Sitemap{return[{url:'https://klinicals.com',lastModified:new Date(),changeFrequency:'monthly',priority:1},{url:'https://klinicals.com/privacy',lastModified:new Date(),changeFrequency:'yearly',priority:.3},{url:'https://klinicals.com/terms',lastModified:new Date(),changeFrequency:'yearly',priority:.3}]}
