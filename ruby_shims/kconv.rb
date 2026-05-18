# Ruby 3.4 no longer ships the old stdlib `kconv`.
# CFPropertyList still requires it, but CocoaPods/Xcodeproj paths we use here
# do not rely on any Kconv APIs, so a no-op shim is enough.

module Kconv
end
