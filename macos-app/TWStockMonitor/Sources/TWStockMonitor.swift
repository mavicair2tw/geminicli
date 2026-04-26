import SwiftUI
import AppKit
import WebKit
import Combine

// MARK: - 0. Floating Panel Base Class
class CustomPanel: NSPanel {
    init(contentRect: NSRect, styleMask: NSWindow.StyleMask = [.borderless, .nonactivatingPanel]) {
        super.init(contentRect: contentRect, styleMask: styleMask, backing: .buffered, defer: false)
        self.level = .floating
        self.isFloatingPanel = true
        self.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        self.backgroundColor = .clear
        self.hasShadow = true
        self.isMovableByWindowBackground = true
    }
}

// MARK: - 1. WebView Component
struct WebView: NSViewRepresentable {
    let url: URL
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawBackground")
        return webView
    }
    func updateNSView(_ nsView: WKWebView, context: Context) {
        if nsView.url?.absoluteString != url.absoluteString {
            nsView.load(URLRequest(url: url))
        }
    }
}

// MARK: - 2. Data Engine
class StockStore: ObservableObject {
    @Published var stocks: [TickerData] = []
    @Published var lastError: String?
    private var cancellable: AnyCancellable?
    
    struct TickerData: Identifiable, Codable {
        let id = UUID()
        let ticker: String
        let price: Double
        let change: Double
        let prev: Double
        
        enum CodingKeys: String, CodingKey { case ticker, metrics }
        enum MetricsKeys: String, CodingKey { case price, previousClose }
        
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            ticker = try c.decode(String.self, forKey: .ticker)
            let m = try c.nestedContainer(keyedBy: MetricsKeys.self, forKey: .metrics)
            price = try m.decode(Double.self, forKey: .price)
            prev = try m.decode(Double.self, forKey: .previousClose)
            change = price - prev
        }
        
        func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(ticker, forKey: .ticker)
            var m = c.nestedContainer(keyedBy: MetricsKeys.self, forKey: .metrics)
            try m.encode(price, forKey: .price)
            try m.encode(prev, forKey: .previousClose)
        }
    }
    
    init() {
        fetch()
        cancellable = Timer.publish(every: 30, on: .main, in: .common).autoconnect().sink { _ in self.fetch() }
    }
    
    func fetch() {
        guard let url = URL(string: "https://money.openai-tw.com/api/watchlist") else { return }
        
        URLSession.shared.dataTask(with: url) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    self.lastError = error.localizedDescription
                    print("Fetch error: \(error)")
                    return
                }
                
                guard let data = data else {
                    self.lastError = "No data received"
                    return
                }
                
                do {
                    let res = try JSONDecoder().decode(WatchlistResponse.self, from: data)
                    self.stocks = res.assets
                    self.lastError = nil
                    print("Fetched \(res.assets.count) stocks")
                } catch {
                    self.lastError = "Decode error: \(error.localizedDescription)"
                    print("Decode error: \(error)")
                    // Log raw data for debugging
                    if let raw = String(data: data, encoding: .utf8) {
                        print("Raw data: \(raw)")
                    }
                }
            }
        }.resume()
    }
}

struct WatchlistResponse: Codable {
    let assets: [StockStore.TickerData]
}

// MARK: - 3. The Desktop Ticker UI
struct TickerBarView: View {
    @ObservedObject var store: StockStore
    var onStockClick: (String) -> Void
    
    var body: some View {
        HStack(spacing: 20) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .foregroundColor(Color(red: 16/255, green: 185/255, blue: 129/255))
                .font(.system(size: 18, weight: .bold))
            
            if store.stocks.isEmpty {
                if let err = store.lastError {
                    Text("Error: \(err)").foregroundColor(.red).font(.caption)
                    Button("Retry") { store.fetch() }.buttonStyle(.link).font(.caption)
                } else {
                    Text("Waiting for watchlist...").foregroundColor(.secondary).font(.caption)
                    Circle()
                        .fill(Color.orange)
                        .frame(width: 8, height: 8)
                        .opacity(0.6)
                }
            }
            
            ForEach(store.stocks) { stock in
                Button(action: { onStockClick(stock.ticker) }) {
                    HStack(spacing: 8) {
                        Text(stock.ticker).fontWeight(.black).foregroundColor(.white)
                        Text(String(format: "%.2f", stock.price)).monospacedDigit().foregroundColor(.white)
                        Text(String(format: "%+.2f%%", (stock.change/stock.prev)*100))
                            .foregroundColor(stock.change >= 0 ? .green : .red)
                            .font(.system(size: 11, weight: .bold))
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 25)
        .frame(height: 50)
        .background(VisualEffectView().clipShape(Capsule()))
        .overlay(Capsule().stroke(Color.white.opacity(0.15), lineWidth: 1))
    }
}

struct VisualEffectView: NSViewRepresentable {
    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.blendingMode = .behindWindow
        view.state = .active
        view.material = .hudWindow
        return view
    }
    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {}
}

// MARK: - 4. Window Manager
class WindowManager: NSObject, ObservableObject {
    static let shared = WindowManager()
    var store = StockStore()
    var tickerPanel: CustomPanel?
    
    func setupTicker() {
        let view = TickerBarView(store: store) { ticker in
            self.toggleChart(for: ticker)
        }
        let panel = CustomPanel(contentRect: NSRect(x: 0, y: 0, width: 800, height: 60))
        panel.contentView = NSHostingView(rootView: view)
        
        if let screen = NSScreen.main {
            let x = (screen.frame.width - 800) / 2
            let y = screen.frame.height - 100
            panel.setFrame(NSRect(x: x, y: y, width: 800, height: 60), display: true)
        }
        
        panel.makeKeyAndOrderFront(nil)
        self.tickerPanel = panel
    }
    
    func toggleChart(for ticker: String) {
        let windowID = "chart-\(ticker)"
        if let existing = NSApp.windows.first(where: { $0.identifier?.rawValue == windowID }) {
            existing.close()
            return
        }
        
        let chartView = VStack(spacing: 0) {
            HStack {
                Text("\(ticker) K-Chart").font(.headline).foregroundColor(.white)
                Spacer()
                Button(action: { NSApp.windows.first(where: { $0.identifier?.rawValue == windowID })?.close() }) {
                    Image(systemName: "xmark.circle.fill").foregroundColor(.gray)
                }.buttonStyle(.plain)
            }
            .padding()
            .background(Color.black.opacity(0.8))
            
            WebView(url: URL(string: "http://localhost:3000/chart?ticker=\(ticker.replacingOccurrences(of: "^", with: "%5E"))")!)
        }
        .frame(width: 900, height: 700)
        .background(VisualEffectView())
        .cornerRadius(20)
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color.white.opacity(0.1), lineWidth: 1))

        let panel = CustomPanel(contentRect: NSRect(x: 0, y: 0, width: 900, height: 700), styleMask: [.borderless, .nonactivatingPanel, .resizable])
        panel.identifier = NSUserInterfaceItemIdentifier(windowID)
        panel.contentView = NSHostingView(rootView: chartView)
        panel.center()
        panel.makeKeyAndOrderFront(nil)
    }
}

@main
struct TWStockMonitorApp: App {
    init() {
        DispatchQueue.main.async {
            WindowManager.shared.setupTicker()
        }
    }
    var body: some Scene {
        Settings { EmptyView() }
    }
}
