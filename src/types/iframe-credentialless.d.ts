import "react";

// `credentialless` is a Chromium iframe attribute that React's DOM typings do
// not carry yet. It loads the frame in an ephemeral storage partition, which is
// how /members discards the iCafeCloud member session between customers.
declare module "react" {
  interface IframeHTMLAttributes<T> {
    credentialless?: boolean | "";
  }
}
