const GA_MEASUREMENT_ID = import.meta.env.VITE_OPENPCT_GA_MEASUREMENT_ID?.trim();
const GA_DEBUG = import.meta.env.VITE_OPENPCT_GA_DEBUG === 'true';

let initialized = false;

type AnalyticsParams = Record<string, string | number | boolean | undefined>;

const hasMeasurementId = (): boolean => Boolean(GA_MEASUREMENT_ID);

export const initAnalytics = () => {
    if (!hasMeasurementId() || initialized || typeof window === 'undefined') return;

    initialized = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
        window.dataLayer?.push(arguments);
    };

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID as string)}`;
    document.head.appendChild(script);

    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID as string, {
        send_page_view: true,
        debug_mode: GA_DEBUG || undefined,
    });
};

export const trackEvent = (name: string, params: AnalyticsParams = {}) => {
    if (!hasMeasurementId() || typeof window === 'undefined' || typeof window.gtag !== 'function') return;

    try {
        window.gtag('event', name, {
            ...params,
            debug_mode: GA_DEBUG || undefined,
        });
    } catch (error) {
        console.debug('Analytics event dropped:', name, error);
    }
};

export const setAnalyticsConsent = (consent: 'granted' | 'denied') => {
    if (!hasMeasurementId() || typeof window === 'undefined' || typeof window.gtag !== 'function') return;

    try {
        window.gtag('consent', 'update', {
            analytics_storage: consent,
        });
    } catch (error) {
        console.debug('Analytics consent update dropped:', error);
    }
};
