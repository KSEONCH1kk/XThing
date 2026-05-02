require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name             = 'XThingVpnPlugin'
  s.version          = package['version']
  s.summary          = package['description']
  s.license          = 'MIT'
  s.homepage         = 'https://example.com/xthing'
  s.author           = 'XThing'
  s.source           = { :git => 'https://example.com/xthing.git', :tag => s.version.to_s }
  # Только Plugin/ — PacketTunnelProvider/ компилируется в ОТДЕЛЬНОМ target,
  # его исходники в pod не входят (они должны принадлежать extension target'у
  # внутри потребительского проекта, см. ios-setup.md).
  s.source_files     = 'ios/Plugin/**/*.{swift,h,m,c}'
  s.ios.deployment_target  = '14.0'
  s.dependency 'Capacitor'
  s.frameworks = 'NetworkExtension'
end
