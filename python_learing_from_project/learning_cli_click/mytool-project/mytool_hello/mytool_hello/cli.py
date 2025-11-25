# mytool_hello/mytool_hello/cli.py
import click
from mytool import cli  # 导入主命令组

@click.command()
@click.option('--name', default='World', help='Name to greet')
def hello(name):
    """Say hello!"""
    click.echo(f"Hello, {name}!")

# 注册到主 CLI
cli.add_command(hello)