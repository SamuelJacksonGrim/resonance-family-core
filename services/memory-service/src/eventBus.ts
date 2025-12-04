import { createClient } from 'redis';

const client = createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:6379`
});

client.on('error', (err) => console.error('Redis Client Error', err));

export const connectBus = async () => {
    await client.connect();
    console.log('🔌 [ECHO-BUS] Connected');
};

export const publishEvent = async (channel: string, payload: any) => {
    if (!client.isOpen) return;
    await client.publish(channel, JSON.stringify(payload));
};
