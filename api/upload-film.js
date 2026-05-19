import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const R2 = new S3Client({
  region: 'auto',
  endpoint: process.env.VITE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.VITE_R2_SECRET_ACCESS_KEY,
  },
})

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { teamId, gameId } = req.body
  const key = `${teamId}/${gameId}/film.mp4`
  const command = new PutObjectCommand({
    Bucket: process.env.VITE_R2_BUCKET,
    Key: key,
    ContentType: 'video/mp4',
  })
  const url = await getSignedUrl(R2, command, { expiresIn: 3600 })
  res.json({ url, key })
}