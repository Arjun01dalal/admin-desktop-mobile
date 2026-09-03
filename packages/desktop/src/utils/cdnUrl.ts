const CLOUDFRONT_ORIGIN = 'https://d1abp4kt5r84bg.cloudfront.net';

const S3_PATH_STYLE = /^https?:\/\/s3[.-][a-z0-9-]*\.?amazonaws\.com\/store\.laxminarayan\.live/i;
const S3_HOSTED_STYLE = /^https?:\/\/store\.laxminarayan\.live\.s3[.-][a-z0-9-]*\.?amazonaws\.com/i;

export function replaceS3WithCloudfront(url?: string | null): string {
  if (!url || typeof url !== 'string') return url || '';
  return url.replace(S3_PATH_STYLE, CLOUDFRONT_ORIGIN).replace(S3_HOSTED_STYLE, CLOUDFRONT_ORIGIN);
}
