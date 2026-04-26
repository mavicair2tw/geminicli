// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TWStockMonitor",
    platforms: [
        .macOS(.v14)
    ],
    targets: [
        .executableTarget(
            name: "TWStockMonitor",
            dependencies: [],
            path: "Sources"
        )
    ]
)
