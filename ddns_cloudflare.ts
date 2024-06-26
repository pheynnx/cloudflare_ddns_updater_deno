// pheynnx
// June 25, 2024
// v0.1

import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { format } from "https://deno.land/std@0.91.0/datetime/mod.ts";

const env = await load();

type DNSRecord = {
  ip: string;
  id: string;
};

async function getCloudflareDNSRecord(): Promise<DNSRecord> {
  const req = new Request(
    `https://api.cloudflare.com/client/v4/zones/${env["ZONE_ID"]}/dns_records?type=A&name=${env["RECORD_NAME"]}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Email": env["AUTH_EMAIL"],
        "X-Auth-Key": env["API_TOKEN"],
      },
    }
  );

  try {
    const res = await fetch(req);
    const data = await res.json();

    return {
      ip: data.result[0].content,
      id: data.result[0].id,
    };
  } catch (error) {
    throw new Error(error);
  }
}

async function updateCloudflareDNSRecordIP(
  recordId: string,
  updatedPublicIP: string
) {
  const req = new Request(
    `https://api.cloudflare.com/client/v4/zones/${env["ZONE_ID"]}/dns_records/${recordId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Email": env["AUTH_EMAIL"],
        "X-Auth-Key": env["API_TOKEN"],
      },
      body: JSON.stringify({ content: updatedPublicIP }),
    }
  );

  try {
    const res = await fetch(req);
    const data = await res.json();

    return data;
  } catch (error) {
    throw new Error(error);
  }
}

async function getPublicIP(): Promise<string> {
  try {
    const res = await fetch("https://domains.google.com/checkip");
    return await res.text();
  } catch (_error) {
    const res = await fetch("https://api.ipify.org");
    return await res.text();
  }
}

async function mailer(publicIp: string) {
  const client = new SMTPClient({
    connection: {
      hostname: env["SMTP_HOST"],
      port: 465,
      tls: true,
      auth: {
        username: env["SMTP_USERNAME"],
        password: env["SMTP_PASSWORD"],
      },
    },
  });
  await client.send({
    from: `${env["SMTP_USERNAME"]}@${env["SMTP_HOST"]}`,
    to: env["SMTP_RECIPIENT"],
    subject: `Cloudflare DNS record updated: ${format(
      new Date(),
      "yyyy-MM-dd HH:mm:ss"
    )}`,
    content: `DNS record updated to ip: ${publicIp}`,
  });
  await client.close();
}

async function main() {
  try {
    const DNSRecord = await getCloudflareDNSRecord();
    const publicIP = await getPublicIP();

    if (DNSRecord.ip !== publicIP) {
      await updateCloudflareDNSRecordIP(DNSRecord.id, publicIP);
      await mailer(publicIP);
      Deno.exit();
    }
  } catch (error) {
    console.log(error);
    Deno.exit();
  }
}
await main();
