"use client";

import Script from "next/script";

type LoaderProps = {
  analytics: boolean;
  advertising: boolean;
};

export function shouldLoadMetaPixel(input: {
  advertising: boolean;
  pixelId?: string;
}): boolean {
  return Boolean(input.advertising && input.pixelId);
}

export function shouldLoadClarity(input: {
  analytics: boolean;
  projectId?: string;
  pathname?: string;
}): boolean {
  const pathname =
    input.pathname ??
    (typeof window === "undefined" ? "" : window.location.pathname);
  return Boolean(input.analytics && input.projectId && !pathname.startsWith("/studio"));
}

export function GTMLoader({ analytics }: LoaderProps) {
  const id = process.env.NEXT_PUBLIC_GTM_ID;
  if (!analytics || !id) return null;
  return (
    <Script id="gyvft-gtm" strategy="afterInteractive">
      {`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${id}');
      `}
    </Script>
  );
}

export function GA4Loader({ analytics }: LoaderProps) {
  const id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  if (!analytics || !id) return null;
  return (
    <>
      <Script async src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="gyvft-ga4" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}

export function MetaPixelLoader({ advertising }: LoaderProps) {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!shouldLoadMetaPixel({ advertising, pixelId: id })) return null;
  return (
    <Script id="gyvft-meta-pixel" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${id}');
        fbq('track', 'PageView');
      `}
    </Script>
  );
}

export function ClarityLoader({ analytics }: LoaderProps) {
  const id = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  if (!shouldLoadClarity({ analytics, projectId: id })) return null;
  return (
    <Script id="gyvft-clarity" strategy="afterInteractive">
      {`
        (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${id}");
      `}
    </Script>
  );
}
