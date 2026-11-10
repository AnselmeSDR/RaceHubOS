// Cuts the subject out of an image with macOS Vision: cutout <in> <out.png>
import AppKit
import CoreImage
import Vision
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 3, let source = NSImage(contentsOfFile: args[1]),
      let cg = source.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
  FileHandle.standardError.write("usage: cutout <in> <out.png>\n".data(using: .utf8)!); exit(1)
}
let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: cg)
try handler.perform([request])
guard let result = request.results?.first else {
  FileHandle.standardError.write("no subject found\n".data(using: .utf8)!); exit(2)
}
let buffer = try result.generateMaskedImage(ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: true)
let image = CIImage(cvPixelBuffer: buffer)
let context = CIContext()
guard let out = context.createCGImage(image, from: image.extent),
      let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL, UTType.png.identifier as CFString, 1, nil) else { exit(3) }
CGImageDestinationAddImage(dest, out, nil)
guard CGImageDestinationFinalize(dest) else { exit(4) }
