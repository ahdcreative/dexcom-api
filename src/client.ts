import { CGMDataType, getLogger, transform } from './utils';

const APPLICATION_ID = 'd89443d2-327c-4a6f-89e5-496bbb0317db';

type DexcomApiClientType = {
    username: string;
    password: string;
    server: 'US' | 'EU';
    fetchOpts?: RequestInit;
    debug?: boolean;
};

export const DexcomApiClient = ({
                                    username,
                                    password,
                                    server,
                                    fetchOpts = {},
                                    debug = false,
                                }: DexcomApiClientType) => {
    const targetServer = server === 'EU' ? 'shareous1.dexcom.com' : 'share2.dexcom.com';
    const baseURL = `https://${targetServer}/ShareWebServices/Services`;
    let sessionId: string | null = null;

    const logger = getLogger(debug);

    // Helper interno che sostituisce axios.create()
    const request = async (endpoint: string, options: RequestInit = {}) => {
        const url = `${baseURL}${endpoint}`;
        const response = await fetch(url, {
            ...fetchOpts,
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(fetchOpts.headers || {}),
                ...(options.headers || {}),
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        return response;
    };

    const login = async () => {
        try {
            logger(`Trying to login with credentials ${username}:********`);

            // 1. Otteniamo l'Account ID
            const authRes = await request('/General/AuthenticatePublisherAccount', {
                method: 'POST',
                body: JSON.stringify({
                    accountName: username,
                    password,
                    applicationId: APPLICATION_ID,
                }),
            });

            // Dexcom restituisce un UUID string, rimuoviamo le virgolette se presenti
            const accountId = (await authRes.text()).replace(/"/g, '');
            if (!accountId || accountId === '00000000-0000-0000-0000-000000000000') {
                throw new Error('Unable to retrieve a valid account id. Check credentials.');
            }

            // 2. Otteniamo il Session ID
            const sessionRes = await request('/General/LoginPublisherAccountById', {
                method: 'POST',
                body: JSON.stringify({
                    accountId,
                    password,
                    applicationId: APPLICATION_ID,
                }),
            });

            sessionId = (await sessionRes.text()).replace(/"/g, '');
            if (!sessionId || sessionId === '00000000-0000-0000-0000-000000000000') {
                logger('Login failed. Invalid session ID returned.');
                throw new Error('Login failed.');
            }

            logger('Login successful!');
        } catch (e: any) {
            logger(`Login failed: ${e.message}`);
            throw new Error('Unable to login in');
        }
    };

    const loginAndTry = async <T>(func: () => Promise<T> | T): Promise<T> => {
        if (!sessionId) await login();

        try {
            return await func();
        } catch (e) {
            logger('Request failed, trying to re-authenticate...');
            await login();
            return await func();
        }
    };

    const read = async (minutesAgo = 1440, count = 288): Promise<CGMDataType[]> =>
        loginAndTry<CGMDataType[]>(async () => {
            // In fetch, i query parameters vanno accodati all'URL
            const params = new URLSearchParams({
                sessionId: sessionId as string,
                minutes: minutesAgo.toString(),
                maxCount: count.toString(),
            });

            logger('Reading CGM data...');

            // La Share API richiede POST anche per leggere i dati
            const response = await request(`/Publisher/ReadPublisherLatestGlucoseValues?${params.toString()}`, {
                method: 'POST',
            });

            const data = await response.json();
            logger('Data successfully retrieved');
            return data.map(transform);
        });

    const readLast = async () => read(9999, 1);

    return {
        login,
        read,
        readLast,
    };
};