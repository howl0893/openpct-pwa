export const MAP_DATA_CACHE_NAME = 'openpct-map-data-v1';

export type CacheStatus = 'unsupported' | 'not-downloaded' | 'downloaded' | 'downloading' | 'failed';

const canUseCacheStorage = (): boolean => 'caches' in window;

const openMapDataCache = async (): Promise<Cache> => {
    if (!canUseCacheStorage()) {
        throw new Error('Offline map downloads are not supported in this browser.');
    }

    return caches.open(MAP_DATA_CACHE_NAME);
};

export const getMapDataCacheStatus = async (paths: string[]): Promise<Record<string, CacheStatus>> => {
    const status: Record<string, CacheStatus> = {};

    if (!canUseCacheStorage()) {
        paths.forEach((path) => {
            status[path] = 'unsupported';
        });
        return status;
    }

    const cache = await openMapDataCache();
    await Promise.all(
        paths.map(async (path) => {
            status[path] = (await cache.match(path)) ? 'downloaded' : 'not-downloaded';
        })
    );

    return status;
};

export const downloadMapDataFile = async (path: string): Promise<void> => {
    const cache = await openMapDataCache();
    const downloadUrl = new URL(path, window.location.href);
    downloadUrl.searchParams.set('openpct-download', Date.now().toString());
    const response = await fetch(downloadUrl.toString(), { cache: 'reload' });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} while downloading ${path}`);
    }

    await cache.put(path, response);
};

export const downloadMapDataFiles = async (
    paths: string[],
    onProgress?: (path: string, completed: number, total: number) => void
): Promise<void> => {
    for (let index = 0; index < paths.length; index += 1) {
        const path = paths[index];
        await downloadMapDataFile(path);
        onProgress?.(path, index + 1, paths.length);
    }
};

export const clearMapDataFiles = async (paths: string[]): Promise<void> => {
    const cache = await openMapDataCache();
    await Promise.all(paths.map((path) => cache.delete(path)));
};
