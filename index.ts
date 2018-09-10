import {parse as parseUrl} from 'url';
import {parse as parseQuerystring} from 'querystring';
import {IncomingMessage} from 'http';

/**
Read the request to the end, parse it based on the Content-Type header, and
extend the request with a `body` field of type `any`.

If 'Content-Type' contains 'application/json', parse the body as JSON.
If 'Content-Type' contains 'application/x-www-form-urlencoded', parse the body as a querystring.
Otherwise, return a Buffer.

When parsing as JSON or querystring, assumes the content encoding is UTF-8.
*/
export function addBody<Req extends IncomingMessage>(req: Req): Promise<Req & {body: any}> {
  // TODO: short-circuit on bodyless requests
  const contentType = req.headers['content-type'] || '';
  const contentEncoding = 'utf8';
  return new Promise<Buffer>((resolve, reject) => {
    var chunks = [];
    return req
    .on('error', reject)
    .on('data', chunk => chunks.push(chunk))
    .on('end', () => resolve(Buffer.concat(chunks)));
  })
  .then(data => {
    if (/application\/json/i.test(contentType)) {
      // empty body translates to undefined
      return (data.length > 0) ? JSON.parse(data.toString(contentEncoding)) : undefined;
    }
    else if (contentType.match(/application\/x-www-form-urlencoded/i)) {
      return parseQuerystring(data.toString(contentEncoding));
    }
    return data;
  })
  .then(body => Object.assign(req, {body}));
}

/**
Middleware to add an `xhr: boolean` field to the request.

Look at the request and set req.xhr = true iff:
1. The request header `X-Requested-With` is "XMLHttpRequest", OR:
2. The request path ends with ".json", OR:
3. The request header `Accept` does not contain "text/html"

req.xhr == true indicates that the response should be JSON.
*/
export function addXhr<Req extends IncomingMessage>(req: Req): Req & {xhr: boolean} {
  // TODO: use the pathname, not the url
  let xhr = (req.headers['x-requested-with'] == 'XMLHttpRequest') ||
            /\.json$/.test(req.url) ||
            !/text\/html/.test(req.headers['accept']);
  return Object.assign(req, {xhr});
}

/**
Selected properties of a fully (parseQueryString=true) parsed NodeJS Url object.
*/
export interface Url {
  /** The request protocol, lowercased. */
  protocol: string;
  /** The authentication information portion of a URL. */
  auth: string;
  /** Just the lowercased hostname portion of the host. */
  hostname: string;
  /** The port number portion of the host. (Yes, it's a string.) */
  port: string;
  /** The path section of the URL, that comes after the host and before the
  query, including the initial slash if present. No decoding is performed. */
  pathname: string;
  /** A querystring-parsed object. */
  query: any;
  /**  The 'fragment' portion of the URL including the pound-sign. */
  hash: string;
}

/**
Add a subset of the parsed NodeJS.Url object to the request.
*/
export function addUrlObj<Req extends IncomingMessage>(req: Req): Req & Url {
  let {protocol, auth, hostname, port, pathname, query, hash} = parseUrl(req.url, true);
  return Object.assign(req, {protocol, auth, hostname, port, pathname, query, hash});
}

/**
Parse the 'Cookie' header of the request.
*/
export function addCookies<Req extends IncomingMessage>(req: Req): Req & {cookies: {[index: string]: string}} {
  // IncomingMessage#headers is an object with all lowercased keys
  let cookies: {[index: string]: string} = {};
  let cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    var cookieHeaderString = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader;
    var cookieStrings = cookieHeaderString.split(/;\s*/);
    cookieStrings.forEach(cookieString => {
      var splitAt = cookieString.indexOf('=');
      var name = cookieString.slice(0, splitAt);
      var value = cookieString.slice(splitAt + 1);
      cookies[name] = decodeURIComponent(value);
    });
  }
  return Object.assign(req, {cookies});
}
