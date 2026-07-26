import {createClient} from "redis";
const globalForQueue=globalThis as unknown as {queue?:ReturnType<typeof createClient>};
export async function getQueue(){const client=globalForQueue.queue??createClient({url:process.env.REDIS_URL});if(!globalForQueue.queue)globalForQueue.queue=client;if(!client.isOpen)await client.connect();return client}