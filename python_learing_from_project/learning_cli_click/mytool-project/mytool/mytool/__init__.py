# mytool/mytool/__init__.py
import click
import pkg_resources  # 更现代的方式替代 get_installed_distributions

@click.group()
def cli():
    """MyTool - A pluggable CLI."""
    pass

def discover_plugins():
    """自动发现所有以 'mytool_' 开头的已安装包，并导入其 .cli 模块"""
    for entry_point in pkg_resources.iter_entry_points(group='mytool.plugins'):
        # 方式1：使用 entry_points（推荐，更标准）
        try:
            entry_point.load()
            print(f"Succeed to load plugin {entry_point.name}: {e}")
        except Exception as e:
            print(f"Failed to load plugin {entry_point.name}: {e}")

    # 方式2：按包名前缀扫描（兼容你看到的 Tesla 风格）
    #for dist in pkg_resources.working_set:
        #print(f"Scanning installed packages... {dist}")
        #name = dist.project_name.replace('-', '_')
        #print(f"name... {name}")
        #if name.startswith("mytool_"):
            #print(f" - {dist.project_name}")
            #mod_name = name + ".cli"
            #print(f"   → Trying to import {mod_name}")
            #try:
            #    __import__(mod_name)
                #print(f"   ✓ Loaded: {mod_name}")
            #except ImportError:
                #print(f"   ✗ Failed: {mod_name}")
            #    pass  # 插件可能没有 cli.py，跳过

def main():
    discover_plugins()
    cli()

if __name__ == '__main__':
    main()