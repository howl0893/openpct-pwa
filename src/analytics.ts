const DEFAULT_GA_MEASUREMENT_ID = 'G-P34VJCTJMV';
const APP_NAME = 'openpct_pwa';

const GA_MEASUREMENT_ID = import.meta.env.VITE_OPENPCT_GA_MEASUREMENT_ID?.trim() || DEFAULT_GA_MEASUREMENT_ID;
const GA_DEBUG = import.meta.env.VITE_OPENPCT_GA_DEBUG === 'true';

let initialized = false;

type AnalyticsParams = Record<string, string | number | boolean | undefined>;
type PageViewParams = AnalyticsParams & {
    page_path: string;
    route_name: string;
};
type ScreenViewParams = AnalyticsParams & {
    screen_name: string;
};
type ClickParams = AnalyticsParams & {
    element_name: string;
    element_type: string;
    element_location?: string;
    destination?: string;
    outbound?: boolean;
};

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
        send_page_view: false,
        debug_mode: GA_DEBUG || undefined,
    });
};

const commonParams = (params: AnalyticsParams = {}): AnalyticsParams => ({
    app_name: APP_NAME,
    page_path:
        typeof window === 'undefined'
            ? undefined
            : `${window.location.pathname}${window.location.search}`,
    page_title: typeof document === 'undefined' ? undefined : document.title,
    debug_mode: GA_DEBUG || undefined,
    ...params,
});

export const trackPageView = (params: PageViewParams) => {
    if (!hasMeasurementId() || typeof window === 'undefined' || typeof window.gtag !== 'function') return;

    try {
        window.gtag('event', 'page_view', {
            ...commonParams(params),
            page_location: window.location.href,
        });
    } catch (error) {
        console.debug('Analytics page view dropped:', params.page_path, error);
    }
};

export const trackScreenView = (params: ScreenViewParams) => {
    trackEvent('screen_view', params);
};

export const trackEvent = (name: string, params: AnalyticsParams = {}) => {
    if (!hasMeasurementId() || typeof window === 'undefined' || typeof window.gtag !== 'function') return;

    try {
        window.gtag('event', name, commonParams(params));
    } catch (error) {
        console.debug('Analytics event dropped:', name, error);
    }
};

export const trackClick = (name: string, params: ClickParams) => {
    trackEvent(name, params);
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
